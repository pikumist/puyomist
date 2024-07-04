import { wrap } from 'comlink';

export const createWorker = () => {
  const workerInstance = new Worker(
    new URL('./solution-worker.ts', import.meta.url),
    {
      type: 'module'
    }
  );
  const workerProxy = wrap<typeof import('./solution-worker')>(workerInstance);

  return {
    workerInstance,
    workerProxy
  };
};
