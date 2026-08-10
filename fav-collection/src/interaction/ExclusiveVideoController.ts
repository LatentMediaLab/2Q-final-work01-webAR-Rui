export interface PlayableVideo {
  currentTime: number;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
}

export class ExclusiveVideoController {
  private activeVideo: PlayableVideo | null = null;

  public async play(video: PlayableVideo): Promise<void> {
    if (this.activeVideo !== null && this.activeVideo !== video) {
      this.stopVideo(this.activeVideo);
    }

    this.activeVideo = video;
    try {
      await video.play();
    } catch (error: unknown) {
      if (this.activeVideo === video) {
        this.activeVideo = null;
      }
      throw error;
    }
  }

  public stop(video: PlayableVideo): void {
    this.stopVideo(video);
    if (this.activeVideo === video) {
      this.activeVideo = null;
    }
  }

  public stopAll(): void {
    if (this.activeVideo === null) {
      return;
    }

    this.stopVideo(this.activeVideo);
    this.activeVideo = null;
  }

  public isActive(video: PlayableVideo): boolean {
    return this.activeVideo === video && !video.paused;
  }

  private stopVideo(video: PlayableVideo): void {
    video.pause();
    video.currentTime = 0;
  }
}
