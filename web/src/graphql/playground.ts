import { gql } from "@apollo/client";

export const ANALYZE_FACE = gql`
  mutation AnalyzeFace($image: Upload!) {
    analyzeFaceAttribute(image: $image) {
      success
      error
      data {
        age
        gender
        emotion
        emotion_score
      }
    }
  }
`;

export const COMPARE_FACES = gql`
  mutation CompareFaces($image1: Upload!, $image2: Upload!) {
    compareFaces(image1: $image1, image2: $image2) {
      success
      error
      data {
        verified
        distance
        similarity_score
        threshold
      }
    }
  }
`;

export const FIND_FACE = gql`
  mutation FindFaceInCrowd($target: Upload!, $crowd: Upload!) {
    findFaceInCrowd(target: $target, crowd: $crowd) {
      success
      matches
      processed_image
      error
    }
  }
`;