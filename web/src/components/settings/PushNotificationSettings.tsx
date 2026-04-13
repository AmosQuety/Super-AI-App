import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useToast } from "../ui/toastContext";
import {
  GET_MY_PUSH_SUBSCRIPTIONS,
  GET_PUSH_NOTIFICATION_CONFIG,
  REGISTER_PUSH_SUBSCRIPTION,
  UNREGISTER_PUSH_SUBSCRIPTION,
} from "../../graphql/push";
import logger from "../../utils/logger";

interface PushNotificationConfigData {
  pushNotificationConfig: {
    enabled: boolean;
    publicKey: string | null;
    serviceWorkerUrl: string;
    rolloutPercent: number;
    reason?: string | null;
  };
}

interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  isActive: boolean;
  updatedAt: string;
}

interface PushSubscriptionListData {
  myPushSubscriptions: PushSubscriptionRecord[];
}

interface RegisterSubscriptionMutationData {
  registerPushSubscription: PushSubscriptionRecord;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const decoded = window.atob(normalized);
  const output = new Uint8Array(decoded.length);

  for (let i = 0; i < decoded.length; i += 1) {
    output[i] = decoded.charCodeAt(i);
  }

  return output;
}

export default function PushNotificationSettings() {
  const { addToast } = useToast();
  const [isBusy, setIsBusy] = useState(false);

  const { data: configData, loading: loadingConfig } = useQuery<PushNotificationConfigData>(GET_PUSH_NOTIFICATION_CONFIG);
  const config = configData?.pushNotificationConfig;

  const { data: subscriptionsData, refetch: refetchSubscriptions } = useQuery<PushSubscriptionListData>(
    GET_MY_PUSH_SUBSCRIPTIONS,
    { skip: !config?.enabled }
  );

  const [registerPushSubscription] = useMutation<RegisterSubscriptionMutationData>(REGISTER_PUSH_SUBSCRIPTION);
  const [unregisterPushSubscription] = useMutation(UNREGISTER_PUSH_SUBSCRIPTION);

  const hasServerSubscription = useMemo(() => {
    return Boolean(subscriptionsData?.myPushSubscriptions?.some((item) => item.isActive));
  }, [subscriptionsData?.myPushSubscriptions]);

  const isSupported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isiOSSafari = isIOS && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent);

  const enablePush = async () => {
    if (!isSupported) {
      addToast({ type: "error", title: "Unsupported", message: "This browser does not support push notifications." });
      return;
    }

    if (!config?.enabled || !config.publicKey) {
      addToast({ type: "error", title: "Unavailable", message: "Push is not configured on the server yet." });
      return;
    }

    setIsBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        addToast({ type: "warning", title: "Permission required", message: "Enable notification permission to receive task updates." });
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        });
      }

      const json = subscription.toJSON();
      const keys = json.keys;
      if (!keys?.p256dh || !keys.auth || !json.endpoint) {
        throw new Error("Invalid browser push subscription payload");
      }

      await registerPushSubscription({
        variables: {
          input: {
            endpoint: json.endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            deviceLabel: "Current browser",
            userAgent: navigator.userAgent,
          },
        },
      });

      await refetchSubscriptions();
      addToast({ type: "success", title: "Enabled", message: "Background task notifications are active for this browser." });
    } catch (error) {
      logger.error("Failed to enable push notifications", error);
      const message = error instanceof Error ? error.message : "Failed to enable push notifications";
      addToast({ type: "error", title: "Error", message });
    } finally {
      setIsBusy(false);
    }
  };

  const disablePush = async () => {
    if (!isSupported) {
      return;
    }

    setIsBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const endpoints = subscriptionsData?.myPushSubscriptions?.map((item) => item.endpoint) ?? [];

      if (subscription?.endpoint) {
        endpoints.unshift(subscription.endpoint);
      }

      const uniqueEndpoints = Array.from(new Set(endpoints));
      await Promise.all(
        uniqueEndpoints.map((endpoint) =>
          unregisterPushSubscription({ variables: { endpoint } })
        )
      );

      if (subscription) {
        await subscription.unsubscribe();
      }

      await refetchSubscriptions();
      addToast({ type: "info", title: "Disabled", message: "Background task notifications are turned off for this browser." });
    } catch (error) {
      logger.error("Failed to disable push notifications", error);
      const message = error instanceof Error ? error.message : "Failed to disable push notifications";
      addToast({ type: "error", title: "Error", message });
    } finally {
      setIsBusy(false);
    }
  };

  if (loadingConfig) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6 flex items-center gap-3 text-slate-300">
        <Loader2 className="animate-spin" size={18} /> Checking notification availability...
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
            <Bell className="text-blue-400" size={18} />
          </div>
          <div>
            <h3 className="font-bold text-white">Background Completion Alerts</h3>
            <p className="text-xs text-slate-400">Receive task-complete notifications even when the tab is closed.</p>
          </div>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest ${hasServerSubscription ? "text-emerald-400" : "text-slate-500"}`}>
          {hasServerSubscription ? "Enabled" : "Disabled"}
        </span>
      </div>

      {!config?.enabled ? (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          Push notifications are unavailable. {config?.reason || "Add VAPID keys and enable the feature flag to activate push."}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Xemora will send privacy-safe notifications for completed or failed long-running operations.
          </p>
          <p className="text-xs text-slate-500">
            Current rollout: {config.rolloutPercent}% of users.
          </p>

          <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
            <h4 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-2">Platform Support and Limits</h4>
            <ul className="text-xs text-slate-300 space-y-1">
              <li>iOS Safari tabs can have stricter background delivery behavior than installed PWAs.</li>
              <li>Android delivery can vary with battery saver and vendor background restrictions.</li>
              <li>Even without push delivery, completed results are always recoverable in Recent AI Tasks.</li>
            </ul>
            {isiOSSafari && (
              <p className="text-[11px] text-amber-300 mt-3">
                Detected iOS Safari. For best reliability, install Xemora to your Home Screen and enable notifications there.
              </p>
            )}
            {isAndroid && (
              <p className="text-[11px] text-blue-300 mt-3">
                Detected Android. If alerts are delayed, set background activity to unrestricted for your browser or installed app.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
            <h4 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-2">Fallback Channel (Recommended)</h4>
            <p className="text-xs text-slate-300">
              For high-value tasks, email is the recommended fallback when push is unavailable. SMS is reserved for urgent workflows.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={enablePush}
              disabled={isBusy || hasServerSubscription}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isBusy ? <Loader2 className="animate-spin" size={16} /> : <Bell size={16} />} Enable Push
            </button>

            <button
              onClick={disablePush}
              disabled={isBusy || !hasServerSubscription}
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isBusy ? <Loader2 className="animate-spin" size={16} /> : <BellOff size={16} />} Disable Push
            </button>
          </div>
        </div>
      )}
    </div>
  );
}