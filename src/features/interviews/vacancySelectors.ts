import type { InterviewStage } from '../../types/interviews';

type StageLike = Pick<InterviewStage, 'status' | 'archivedAt' | 'startsAt' | 'updatedAt'>;

function isActiveStage(stage: StageLike): boolean {
  return stage.status !== 'archived' && !stage.archivedAt;
}

function compareStageSchedule(left: StageLike, right: StageLike): number {
  const leftTime = left.startsAt ?? Number.MAX_SAFE_INTEGER;
  const rightTime = right.startsAt ?? Number.MAX_SAFE_INTEGER;
  return leftTime - rightTime || right.updatedAt.localeCompare(left.updatedAt);
}

export function getNearestStage<T extends StageLike>(stages: T[], referenceMs = Date.now()): T | null {
  const active = stages.filter(isActiveStage);
  if (active.length === 0) return null;

  const upcoming = active
    .filter(stage => typeof stage.startsAt === 'number' && stage.startsAt >= referenceMs)
    .sort(compareStageSchedule);
  if (upcoming[0]) return upcoming[0];

  const recentPast = active
    .filter(stage => typeof stage.startsAt === 'number')
    .sort((left, right) => (right.startsAt ?? 0) - (left.startsAt ?? 0) || right.updatedAt.localeCompare(left.updatedAt));
  if (recentPast[0]) return recentPast[0];

  return [...active].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}
