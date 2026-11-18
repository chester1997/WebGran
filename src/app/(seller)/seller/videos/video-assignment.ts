export interface VideoAssignmentInput {
  assignedProductsCount?: number;
  assignmentCount?: number;
  assignments?: unknown[];
}

/** Quantidade de produtos ligados ao vídeo (aceita os formatos de dado que o loader devolve). */
export function getVideoAssignedCount(video: VideoAssignmentInput): number {
  return video.assignedProductsCount || video.assignmentCount || video.assignments?.length || 0;
}
