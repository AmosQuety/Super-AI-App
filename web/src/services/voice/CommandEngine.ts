// src/services/voice/CommandEngine.ts

export type CommandAction = "NAVIGATE" | "ACTION" | "QUERY";

export interface VoiceCommand {
  id: string;
  phrase: string; // The text to match (can be regex pattern string)
  action: CommandAction;
  payload: string; // e.g., URL path or function name
  confidenceThreshold?: number;
}

export const DEFAULT_COMMANDS: VoiceCommand[] = [
  // Navigation
  { id: "nav_home", phrase: "(go to|open) (home|dashboard)", action: "NAVIGATE", payload: "/dashboard" },
  { id: "nav_chat", phrase: "(go to|open) (chat|conversations)", action: "NAVIGATE", payload: "/chat" },
  { id: "nav_image", phrase: "(go to|open) (image|generation|art)", action: "NAVIGATE", payload: "/image" },
  { id: "nav_voice", phrase: "(go to|open) (voice|tools)", action: "NAVIGATE", payload: "/voice" },
  { id: "nav_playground", phrase: "(go to|open) (playground|face|biometrics)", action: "NAVIGATE", payload: "/playground" },
  { id: "nav_settings", phrase: "(open) (settings|profile|account)", action: "NAVIGATE", payload: "/profile" },
  
  // Actions
  { id: "act_logout", phrase: "(log out|sign out)", action: "ACTION", payload: "LOGOUT" },
  { id: "act_theme_dark", phrase: "switch to dark mode", action: "ACTION", payload: "THEME_DARK" },
  { id: "act_theme_light", phrase: "switch to light mode", action: "ACTION", payload: "THEME_LIGHT" },
];

export class CommandEngine {
  private commands: VoiceCommand[];

  constructor(customCommands: VoiceCommand[] = []) {
    this.commands = [...DEFAULT_COMMANDS, ...customCommands];
  }

  public match(transcript: string): VoiceCommand | null {
    const normalize = (text: string) => text.toLowerCase().trim();
    const cleanTranscript = normalize(transcript);

    for (const cmd of this.commands) {
      try {
        // Create regex from phrase, case insensitive
        const regex = new RegExp(cmd.phrase, 'i');
        if (regex.test(cleanTranscript)) {
          return cmd;
        }
      } catch (e) {
        console.warn(`Invalid regex for command ${cmd.id}:`, e);
      }
    }
    return null;
  }

  public registerCommand(command: VoiceCommand) {
    this.commands.push(command);
  }
}
