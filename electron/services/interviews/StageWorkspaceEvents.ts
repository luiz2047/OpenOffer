import { BrowserWindow } from 'electron';

let eventSeq = 0;

export type StageWorkspaceInvalidationSource = {
  stageId: string;
  revision: number;
  activeSession?: { revision: number } | null;
};

export function broadcastStageWorkspaceInvalidated(snapshot: StageWorkspaceInvalidationSource): void {
  const payload = {
    stageId: snapshot.stageId,
    workspaceRevision: snapshot.revision,
    sessionRevision: snapshot.activeSession?.revision ?? null,
    eventSeq: ++eventSeq,
  };
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('stage-workspace-invalidated', payload);
  });
}
