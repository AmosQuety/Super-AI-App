export interface Task {
  id: string;
  feature: string;
  status: string;
  progress: number;
  metadata: any;
  resultReference?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failedAt?: string;
  canceledAt?: string;
}

export interface TaskData {
  task: Task;
}
