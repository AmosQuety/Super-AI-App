// src/resolvers/scalars.ts
import { GraphQLScalarType } from "graphql";
import { Kind } from "graphql/language";
import { GraphQLUpload } from "graphql-upload-minimal";

export const scalarResolvers = {
  Upload: GraphQLUpload,
  DateTime: new GraphQLScalarType({
    name: "DateTime",
    description: "Date custom scalar type",
    serialize(value: any) {
      if (value instanceof Date) return value.toISOString();
      if (typeof value === "number") return new Date(value).toISOString();
      if (typeof value === "string") return new Date(value).toISOString();
      throw new Error("Value must be a Date, number, or string");
    },
    parseValue(value: any) {
      return new Date(value);
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) return new Date(ast.value);
      return null;
    },
  }),
};