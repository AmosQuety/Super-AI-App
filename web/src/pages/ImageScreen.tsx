import React from "react";
import { ImageGenerator } from "../components/ImageGenerator";

export const ImageScreen: React.FC = () => {
  const userId = "1"; // temporary mock user
  return <ImageGenerator userId={userId} />;
};
