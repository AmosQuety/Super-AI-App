import { gql } from "@apollo/client";

export const GET_MY_TASKS = gql`
  query GetMyTasks($limit: Int, $includeArchived: Boolean) {
    myTasks(limit: $limit, includeArchived: $includeArchived) {
      id
      feature
      status
      progress
      metadata
      resultReference
      errorMessage
      createdAt
      updatedAt
      completedAt
      failedAt
      canceledAt
    }
  }
`;

export const GET_TASK = gql`
  query GetTask($id: String!) {
    task(id: $id) {
      id
      feature
      status
      progress
      metadata
      resultReference
      errorMessage
      createdAt
      updatedAt
      completedAt
      failedAt
      canceledAt
    }
  }
`;