// web/src/lib/uploadLink.ts
import { ApolloLink, Observable } from "@apollo/client";
import type { Operation } from "@apollo/client";
import { print } from "graphql"; 
import type { DocumentNode } from "graphql";

type TreeValue = File | unknown[] | Record<string, unknown> | string | number | boolean | null | undefined;

export function createUploadLink({ uri, headers = {} }: { uri: string; headers?: Record<string, string> }) {
  return new ApolloLink((operation: Operation) => {
    return new Observable((observer) => {
      // ✅ FIX: Get the context which includes the auth token from authLink
      const context = operation.getContext();
      const fetchOptions = context.fetchOptions || {};
      const contextHeaders = context.headers || {}; // This has the Bearer token!

      const { variables, query } = operation;

      const body = new FormData();
      const map: Record<string, string[]> = {};
      const files: File[] = [];

      const extractFiles = (tree: TreeValue, path: string[]): TreeValue => {
        if (tree === null || tree === undefined) return tree;
        if (typeof tree !== 'object') return tree;

        if (tree instanceof File) {
          const key = `${files.length}`;
          files.push(tree);
          map[key] = [path.join('.')];
          return null; 
        }

        if (Array.isArray(tree)) {
          return tree.map((item, index) => 
            extractFiles(item as TreeValue, [...path, `${index}`])
          );
        }

        const newObj: Record<string, TreeValue> = {};
        Object.keys(tree as Record<string, TreeValue>).forEach((key) => {
          newObj[key] = extractFiles(
            (tree as Record<string, TreeValue>)[key], 
            [...path, key]
          );
        });
        return newObj;
      };

      const cleanVariables = extractFiles(variables as TreeValue, ['variables']);

      const queryString = typeof query === 'string' 
        ? query 
        : print(query as DocumentNode);
      
      body.append("operations", JSON.stringify({
        query: queryString,
        variables: cleanVariables
      }));

      body.append("map", JSON.stringify(map));

      files.forEach((file, index) => {
        body.append(`${index}`, file, file.name);
      });

      // ✅ FIX: Merge headers properly - contextHeaders has the auth token!
      const finalHeaders = {
        ...headers,           // Base headers (apollo-require-preflight)
        ...contextHeaders,    // Auth token from authLink
      };

      // ✅ DEBUG: Log to verify token is present
      console.log('🔐 Upload request headers:', {
        hasAuthorization: !!finalHeaders.authorization,
        headerKeys: Object.keys(finalHeaders)
      });

      fetch(uri, {
        method: "POST",
        body,
        headers: finalHeaders, // ✅ Use merged headers
        ...fetchOptions,
      })
        .then(async (result) => {
          const text = await result.text();
          
          if (!result.ok) {
            console.error("❌ Upload Error Body:", text);
            throw new Error(`HTTP ${result.status}: ${result.statusText}`);
          }

          try {
            const json = JSON.parse(text);
            observer.next(json);
            observer.complete();
          } catch {
            console.error("❌ Invalid JSON response:", text);
            throw new Error("Invalid JSON response from server");
          }
        })
        .catch((error) => {
          console.error("❌ Upload fetch error:", error);
          observer.error(error);
        });
    });
  });
}