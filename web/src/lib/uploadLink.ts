// web/src/lib/uploadLink.ts
import { ApolloLink, Observable } from "@apollo/client";
import { print } from "graphql"; 

export function createUploadLink({ uri, headers = {} }: { uri: string; headers?: Record<string, string> }) {
  return new ApolloLink((operation) => {
    return new Observable((observer) => {
      // 1. Get the context (This is where AuthLink put the token!)
      const context = operation.getContext();
      const fetchOptions = context.fetchOptions || {};
      const contextHeaders = context.headers || {}; // <--- THIS HOLDS THE TOKEN

      const { variables, query } = operation;

      const body = new FormData();
      const map: Record<string, string[]> = {};
      const files: File[] = [];

      const extractFiles = (tree: any, path: string[]): any => {
        if (!tree) return tree;
        if (typeof tree !== 'object') return tree;

        if (tree instanceof File) {
          const key = `${files.length}`;
          files.push(tree);
          map[key] = [path.join('.')];
          return null; 
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

      const cleanVariables = extractFiles(variables, ['variables']);

      const queryString = typeof query !== 'string' ? print(query) : query;
      
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
          ...headers,        // Headers passed to the link factory
          ...contextHeaders, // <--- CRITICAL: Add the Auth Token here!
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