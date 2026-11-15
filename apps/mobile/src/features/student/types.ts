export type Task = {
  id: string;
  title: string;
  subject: string;
  type: string;
  due: string;
  status: 'todo' | 'doing' | 'done';
  estimate: string;
};
