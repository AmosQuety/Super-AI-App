// app/features/image/index.tsx
import { skipToken, useMutation, useQuery } from '@apollo/client/react';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GENERATE_AI_IMAGE_VARIANTS,
  GET_AI_IMAGE_STATUS,
  GET_MY_TASKS,
  GET_TASK,
} from '../../../services/graphql/operations';
import {
  MAX_PROMPT_LENGTH,
  base64FromDataUri,
  canGenerate,
  describeGenerationError,
  describeGenerationFailure,
  findRunningImageTaskId,
  imageExtension,
  imageFileName,
  keepUsableImages,
  parseTaskImages,
  parseTaskPrompt,
  restoreState,
  type GenerationFailure,
} from '../../../libs/image-generation';
import type { TaskRecord } from '../../../libs/tasks';

const TASK_POLL_MS = 2000;

interface GenerateResult {
  generateAIImageVariants: { success: boolean; images?: string[] | null; error?: string | null };
}

interface TaskResult {
  task: {
    id: string;
    feature: string;
    status: string;
    progress: number;
    metadata?: string | null;
  } | null;
}

export default function ImageScreen() {
  const { taskId: taskIdParam } = useLocalSearchParams<{ taskId?: string }>();
  const taskId = Array.isArray(taskIdParam) ? taskIdParam[0] : taskIdParam;

  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [failure, setFailure] = useState<GenerationFailure | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [enlarged, setEnlarged] = useState<number | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());
  // The request takes a while and the user may leave; its answer must not touch a gone screen,
  // and two taps must not start two generations (each one uses the daily allowance).
  const isMounted = useRef(true);
  const isGeneratingRef = useRef(false);
  // Once the user starts a new generation, a restored result must not replace it.
  const userStartedRef = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const { data: statusData, loading: statusLoading } = useQuery<{
    aiImageGenerationStatus: { available: boolean; message: string };
  }>(GET_AI_IMAGE_STATUS, { fetchPolicy: 'network-only' });
  const serviceAvailable = statusData?.aiImageGenerationStatus?.available ?? false;
  const serviceKnown = !statusLoading && statusData !== undefined;

  const [generate] = useMutation<GenerateResult>(GENERATE_AI_IMAGE_VARIANTS);

  // Opened without a task: is a generation from an earlier visit still running? Asked once, on
  // arrival, so leaving mid-generation and coming back shows it instead of inviting a second
  // paid one. skipToken, not `skip`: with a task id nothing extra may be requested.
  const { data: recentTasksData } = useQuery<{ myTasks: TaskRecord[] }>(
    GET_MY_TASKS,
    taskId
      ? skipToken
      : { variables: { limit: 5, includeArchived: false }, fetchPolicy: 'network-only' }
  );
  const runningTaskId = findRunningImageTaskId(recentTasksData?.myTasks);
  const activeTaskId = taskId ?? runningTaskId ?? undefined;

  // Restoring a result: poll the task until it is no longer running. `no-cache` keeps the images
  // (megabytes) out of the shared Apollo cache, where a later task-list response would overwrite
  // them and where they would stay in memory.
  const {
    data: taskData,
    error: taskError,
    loading: taskLoading,
    stopPolling,
  } = useQuery<TaskResult>(
    GET_TASK,
    activeTaskId
      ? { variables: { id: activeTaskId }, fetchPolicy: 'no-cache', pollInterval: TASK_POLL_MS }
      : skipToken
  );
  const restoredTask = taskData?.task ?? null;
  const restore = restoreState({
    taskId: activeTaskId,
    task: restoredTask,
    error: Boolean(taskError),
    loading: taskLoading,
  });

  useEffect(() => {
    if (restore === 'missing' || restore === 'completed' || restore === 'failed') stopPolling();
    if (userStartedRef.current || !restoredTask) return;
    if (restore === 'completed') {
      setPrompt(parseTaskPrompt(restoredTask.metadata));
      setImages(parseTaskImages(restoredTask.metadata));
      setFailure(null);
    } else if (restore === 'failed') {
      setPrompt(parseTaskPrompt(restoredTask.metadata));
      setFailure(describeGenerationFailure(null));
    }
  }, [restore, restoredTask, stopPolling]);

  const startGeneration = useCallback(async () => {
    if (isGeneratingRef.current || !canGenerate(prompt)) return;
    isGeneratingRef.current = true;
    userStartedRef.current = true;
    setIsGenerating(true);
    setFailure(null);
    setImages([]);
    setSavedIndexes(new Set());
    try {
      const { data } = await generate({ variables: { prompt: prompt.trim() } });
      if (!isMounted.current) return;
      const result = data?.generateAIImageVariants;
      const usable = keepUsableImages(result?.images);
      if (result?.success && usable.length > 0) {
        setImages(usable);
      } else {
        setFailure(describeGenerationFailure(result?.error));
      }
    } catch (error) {
      if (!isMounted.current) return;
      console.warn('Image generation failed.');
      setFailure(describeGenerationError(error));
    } finally {
      isGeneratingRef.current = false;
      if (isMounted.current) setIsGenerating(false);
    }
  }, [generate, prompt]);

  const saveImage = useCallback(
    async (index: number) => {
      const source = images[index];
      if (!source || savingIndex !== null) return;
      setSavingIndex(index);
      let cacheFile: string | null = null;
      try {
        const permission = await MediaLibrary.requestPermissionsAsync(true);
        if (!permission.granted) {
          Alert.alert('Cannot save', 'Allow access to your photos to save this image.');
          return;
        }
        const target = `${FileSystem.cacheDirectory}${imageFileName(prompt, index, imageExtension(source))}`;
        const base64 = base64FromDataUri(source);
        if (!base64) throw new Error('not inline image data');
        // Remembered before writing, so a half-written file is removed too.
        cacheFile = target;
        await FileSystem.writeAsStringAsync(target, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await MediaLibrary.saveToLibraryAsync(target);
        if (isMounted.current) setSavedIndexes((previous) => new Set(previous).add(index));
      } catch {
        console.warn('Saving an image failed.');
        Alert.alert('Could not save', 'The image could not be saved. Please try again.');
      } finally {
        if (cacheFile) await FileSystem.deleteAsync(cacheFile, { idempotent: true });
        if (isMounted.current) setSavingIndex(null);
      }
    },
    [images, prompt, savingIndex]
  );

  const showRestoring =
    (restore === 'loading' || restore === 'running') &&
    !userStartedRef.current &&
    images.length === 0;
  const generateDisabled =
    isGenerating || showRestoring || !canGenerate(prompt) || (serviceKnown && !serviceAvailable);
  const taskMissing = restore === 'missing' && Boolean(taskId);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled">
        {serviceKnown && !serviceAvailable ? (
          <View
            testID="image-service-unavailable"
            accessibilityRole="alert"
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <Text className="text-sm text-amber-900">
              Image creation is not available right now. Please try again later.
            </Text>
          </View>
        ) : null}

        <Text className="mb-2 text-sm font-medium text-gray-700">Describe the image</Text>
        <TextInput
          testID="image-prompt"
          accessibilityLabel="Describe the image"
          className="min-h-[96px] rounded-2xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900"
          style={{ textAlignVertical: 'top' }}
          placeholder="A red fox in a snowy forest, soft morning light"
          placeholderTextColor="#6b7280"
          value={prompt}
          onChangeText={setPrompt}
          multiline
          maxLength={MAX_PROMPT_LENGTH}
          editable={!isGenerating}
        />
        <Text className="mb-4 mt-1 text-right text-xs text-gray-600">
          {prompt.length}/{MAX_PROMPT_LENGTH}
        </Text>

        <TouchableOpacity
          testID="image-generate"
          onPress={startGeneration}
          disabled={generateDisabled}
          accessibilityRole="button"
          accessibilityLabel="Create images"
          accessibilityState={{ disabled: generateDisabled, busy: isGenerating }}
          className={`min-h-[48px] flex-row items-center justify-center rounded-2xl px-6 ${
            generateDisabled ? 'bg-gray-300' : 'bg-purple-600'
          }`}>
          {isGenerating ? (
            <ActivityIndicator color="white" />
          ) : (
            <Ionicons name="sparkles" size={20} color="white" />
          )}
          <Text className="ml-2 text-base font-semibold text-white">
            {isGenerating ? 'Creating…' : 'Create images'}
          </Text>
        </TouchableOpacity>

        {isGenerating || showRestoring ? (
          <View
            testID="image-progress"
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Creating four images. This can take up to a minute."
            className="mt-6 items-center rounded-2xl border border-gray-200 bg-white p-6">
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text className="mt-3 text-center text-base font-semibold text-gray-800">
              Creating four images
            </Text>
            <Text className="mt-1 text-center text-sm text-gray-600">
              This can take up to a minute. You can leave this screen: the result will be in AI
              tasks.
            </Text>
          </View>
        ) : null}

        {failure ? (
          <View
            testID="image-error"
            accessibilityRole="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <Text className="text-sm text-red-800">{failure.message}</Text>
            {failure.canRetry && canGenerate(prompt) ? (
              <TouchableOpacity
                testID="image-retry"
                onPress={startGeneration}
                disabled={isGenerating}
                accessibilityRole="button"
                accessibilityLabel="Try creating the images again"
                className="mt-2 min-h-[44px] justify-center">
                <Text className="text-sm font-semibold text-red-800">Try again</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {restore === 'completed' && images.length === 0 && !isGenerating ? (
          <Text testID="image-task-empty" className="mt-6 text-center text-base text-gray-700">
            This task has no images to show.
          </Text>
        ) : null}

        {taskMissing ? (
          <Text testID="image-task-missing" className="mt-6 text-center text-base text-gray-700">
            This task could not be found.
          </Text>
        ) : null}

        {images.length > 0 ? (
          <View testID="image-results" className="mt-6 flex-row flex-wrap justify-between">
            {images.map((source, index) => (
              <View key={`${index}-${source.slice(-24)}`} className="mb-4 w-[48%]">
                <TouchableOpacity
                  testID="image-result"
                  onPress={() => setEnlarged(index)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`Image ${index + 1} of ${images.length}. Tap to enlarge`}>
                  <Image
                    source={{ uri: source }}
                    className="aspect-square w-full rounded-2xl bg-gray-200"
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => saveImage(index)}
                  disabled={savingIndex !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Save image ${index + 1}`}
                  className="mt-2 min-h-[44px] flex-row items-center justify-center rounded-xl border border-gray-200 bg-white">
                  {savingIndex === index ? (
                    <ActivityIndicator size="small" color="#7c3aed" />
                  ) : (
                    <Ionicons
                      name={savedIndexes.has(index) ? 'checkmark-circle' : 'download-outline'}
                      size={18}
                      color={savedIndexes.has(index) ? '#15803d' : '#374151'}
                    />
                  )}
                  <Text className="ml-2 text-sm font-semibold text-gray-800">
                    {savedIndexes.has(index) ? 'Saved' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={enlarged !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEnlarged(null)}>
        <View className="flex-1 items-center justify-center bg-black/90 p-4">
          {enlarged !== null && images[enlarged] ? (
            <Image
              source={{ uri: images[enlarged] }}
              className="aspect-square w-full"
              resizeMode="contain"
              accessibilityLabel={`Image ${enlarged + 1}, enlarged`}
            />
          ) : null}
          <TouchableOpacity
            onPress={() => setEnlarged(null)}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="mt-6 min-h-[48px] items-center justify-center rounded-2xl bg-white px-8">
            <Text className="text-base font-semibold text-gray-900">Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
