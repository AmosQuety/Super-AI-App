// web/src/lib/uploadLink.ts
import { ApolloLink, Observable } from "@apollo/client";
import { print } from "graphql"; // <--- Import the printer here!

export function createUploadLink({ uri, headers = {} }: { uri: string; headers?: Record<string, string> }) {
  return new ApolloLink((operation) => {
    return new Observable((observer) => {
      const context = operation.getContext();
      const fetchOptions = context.fetchOptions || {};

      const { variables, query } = operation;

      // 1. Setup the FormData
      const body = new FormData();

      // 2. Map to store file locations & array to hold files
      const map: Record<string, string[]> = {};
      const files: File[] = [];

      // Helper to walk the tree, replace Files with null, and populate map/files
      const extractFiles = (tree: any, path: string[]): any => {
        if (!tree) return tree;

        if (typeof tree !== 'object') return tree;

        if (tree instanceof File) {
          const key = `${files.length}`;
          files.push(tree);
          // GraphQL Upload spec requires the path to be variables.input.image etc.
          map[key] = [path.join('.')];
          return null; // Replace file with null in the variables JSON
        }

        if (Array.isArray(tree)) {
          return tree.map((item, index) => extractFiles(item, [...path, `${index}`]));
        }

        const newObj: any = {};
        Object.keys(tree).forEach((key) => {
          newObj[key] = extractFiles(tree[key], [...path, key]);
        });
        return newObj;
      };

      // Perform extraction
      const cleanVariables = extractFiles(variables, ['variables']);

      // 3. Append 'operations' FIRST
      // We use the imported 'print' function here instead of require('graphql')
      const queryString = typeof query !== 'string' ? print(query) : query;
      
      body.append("operations", JSON.stringify({
        query: queryString,
        variables: cleanVariables
      }));

      // 4. Append 'map' SECOND
      body.append("map", JSON.stringify(map));

      // 5. Append files LAST
      files.forEach((file, index) => {
        body.append(`${index}`, file, file.name);
      });

      // 6. Send Request
      fetch(uri, {
        method: "POST",
        body,
        headers: {
          ...headers,
          // Important: Do NOT set Content-Type here. 
          // The browser automatically sets it to multipart/form-data with the correct boundary.
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
          } catch (e) {
            console.error("❌ Invalid JSON response:", text);
            throw new Error("Invalid JSON response from server");
          }
        })
        .catch((err) => {
          console.error("❌ Upload fetch error:", err);
          observer.error(err);
        });
    });
  });
}