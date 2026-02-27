/**
 * JSON Schema definition for a tool's accepted parameters.
 * Kept as a plain object so callers can use any JSON Schema library.
 */
export type ParametersSchema = Readonly<Record<string, unknown>>;

/**
 * Defines a single tool that can be invoked by the model.
 *
 * Generic over TArgs so that handler implementations can be strongly typed
 * without leaking `unknown` everywhere.
 *
 * @template TArgs - The TypeScript type of the parsed arguments object.
 *
 * @example
 * ```ts
 * const weatherTool: ToolDefinition<{ location: string }> = {
 *   name: 'get_weather',
 *   description: 'Returns the current weather for a given location.',
 *   parameters: {
 *     type: 'object',
 *     properties: { location: { type: 'string' } },
 *     required: ['location'],
 *   },
 *   handler: async ({ location }) => fetchWeather(location),
 * };
 * ```
 */
export interface ToolDefinition<TArgs = Record<string, unknown>> {
  /**
   * Unique, snake_case name for this tool.
   * Must be stable — the model references it by this exact string.
   */
  readonly name: string;

  /**
   * Human-readable description sent to the model in the system context.
   * Describe what the tool does and when to call it.
   */
  readonly description: string;

  /**
   * JSON Schema object that describes the tool's accepted parameters.
   * Sent verbatim to the provider's tools API.
   */
  readonly parameters: ParametersSchema;

  /**
   * The execution handler.
   * Must resolve (never reject) for happy-path invocations.
   * The {@link ToolSandbox} wraps this in a timeout + error-capture layer.
   *
   * @param args - Parsed arguments, validated by the model against `parameters`.
   * @returns Any JSON-serialisable value. The sandbox will JSON.stringify it.
   */
  readonly handler: (args: TArgs) => Promise<unknown>;
}
