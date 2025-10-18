import axios from "axios";
import FormData from "form-data";
import { Upload } from "../resolvers/types/context";

const PYTHON_SERVICE_URL = "http://127.0.0.1:5001";

export class FaceRecognitionService {
  async checkHealth() {
    try {
      const response = await axios.get(`${PYTHON_SERVICE_URL}/health`, {
        timeout: 5000,
      });
      return { isOnline: true, data: response.data };
    } catch (error) {
      console.error("Error checking face service health:", error);
      return { isOnline: false, data: null };
    }
  }

  async checkUserHasFace(userId: string): Promise<boolean> {
    try {
      const response = await axios.get(`${PYTHON_SERVICE_URL}/registered-users`);
      const registeredUsers = response.data.registered_users || [];
      return registeredUsers.includes(userId);
    } catch (error) {
      console.error("Error checking registered faces:", error);
      return false;
    }
  }

  async getRegisteredUsers(): Promise<string[]> {
    try {
      const response = await axios.get(`${PYTHON_SERVICE_URL}/registered-users`);
      return response.data.registered_users || [];
    } catch (error) {
      console.error("Error getting registered users:", error);
      return [];
    }
  }

  async registerFace(image: Upload, userId: string) {
    const { createReadStream, filename } = await image;
    const stream = createReadStream();

    const formData = new FormData();
    formData.append("image", stream, { filename });
    formData.append("user_id", userId);

    const response = await axios.post(
      `${PYTHON_SERVICE_URL}/register-face`,
      formData,
      {
        headers: { ...formData.getHeaders() },
        timeout: 30000,
      }
    );

    return response.data;
  }

  async recognizeFace(image: Upload) {
    const { createReadStream, filename } = await image;
    const stream = createReadStream();

    const formData = new FormData();
    formData.append("image", stream, { filename });

    const response = await axios.post(
      `${PYTHON_SERVICE_URL}/recognize-face`,
      formData,
      {
        headers: { ...formData.getHeaders() },
        timeout: 30000,
      }
    );

    return response.data;
  }
}