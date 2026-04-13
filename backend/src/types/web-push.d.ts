declare module "web-push" {
  export interface PushSubscription {
    endpoint: string;
    expirationTime: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  export interface SendResult {
    statusCode?: number;
    body?: string;
    headers?: Record<string, string>;
  }

  const webpush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(subscription: PushSubscription, payload?: string): Promise<SendResult>;
    generateVAPIDKeys(): { publicKey: string; privateKey: string };
  };

  export default webpush;
}