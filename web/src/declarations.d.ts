// src/declarations.d.ts
declare module 'apollo-upload-client' {
  import { ApolloLink } from '@apollo/client';
  
  export interface UploadLinkOptions {
    uri?: string;
    includeExtensions?: boolean;
    headers?: any;
    credentials?: string;
    fetch?: any;
  }

  export default function createUploadLink(options?: UploadLinkOptions): ApolloLink;
}