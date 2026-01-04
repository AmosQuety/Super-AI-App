// web/src/lib/uploadLink.ts
import { ApolloLink, Observable } from "@apollo/client";
import type { Operation } from "@apollo/client"; // Type-only import
import { print } from "graphql"; 
import type { DocumentNode } from "graphql"; // Type-only import

type TreeValue = File | unknown[] | Record<string, unknown> | string | number | boolean | null | undefined;

export function createUploadLink({ uri, headers = {} }: { uri: string; headers?: Record<string, string> }) {
  return new ApolloLink((operation: Operation) => {
    return new Observable((observer) => {
      // 1. Get the context (This is where AuthLink put the token!)
      const context = operation.getContext();
      const fetchOptions = context.fetchOptions || {};
      const contextHeaders = context.headers || {};

      const { variables, query } = operation;

      const body = new FormData();
      const map: Record<string, string[]> = {};
      const files: File[] = [];

      const extractFiles = (tree: TreeValue, path: string[]): TreeValue => {
        // Handle null/undefined
        if (tree === null || tree === undefined) return tree;
        
        // Handle primitive values
        if (typeof tree !== 'object') return tree;

        // Handle File objects
        if (tree instanceof File) {
          const key = `${files.length}`;
          files.push(tree);
          map[key] = [path.join('.')];
          return null; 
        }

        // Handle arrays
        if (Array.isArray(tree)) {
          return tree.map((item, index) => 
            extractFiles(item as TreeValue, [...path, `${index}`])
          );
        }

        // Handle plain objects
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

      // 2. Send Request with MERGED HEADERS
      fetch(uri, {
        method: "POST",
        body,
        headers: {
          ...headers,
          ...contextHeaders,
        },
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