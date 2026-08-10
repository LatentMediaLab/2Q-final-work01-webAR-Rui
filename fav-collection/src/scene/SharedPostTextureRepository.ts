import * as THREE from "three";

export type PostTextureLoader = (source: string) => Promise<THREE.Texture>;

const defaultTextureLoader = new THREE.TextureLoader();

export class SharedPostTextureRepository {
  private readonly pendingBySource = new Map<string, Promise<THREE.Texture>>();
  private readonly loadedTextures = new Set<THREE.Texture>();
  private generation = 0;

  public constructor(
    private readonly loader: PostTextureLoader = (source) =>
      defaultTextureLoader.loadAsync(source),
  ) {}

  public load(source: string): Promise<THREE.Texture> {
    const existing = this.pendingBySource.get(source);
    if (existing !== undefined) {
      return existing;
    }

    const generation = this.generation;
    const request = this.loader(source)
      .then((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.userData.sharedResource = true;

        if (generation !== this.generation) {
          texture.dispose();
          return texture;
        }

        this.loadedTextures.add(texture);
        return texture;
      })
      .catch((error: unknown) => {
        if (this.pendingBySource.get(source) === request) {
          this.pendingBySource.delete(source);
        }
        throw error;
      });

    this.pendingBySource.set(source, request);
    return request;
  }

  public dispose(): void {
    this.generation += 1;
    this.loadedTextures.forEach((texture) => texture.dispose());
    this.loadedTextures.clear();
    this.pendingBySource.clear();
  }
}

export const sharedPostTextureRepository = new SharedPostTextureRepository();
