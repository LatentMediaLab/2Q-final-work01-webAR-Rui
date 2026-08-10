export type ArPlacementState = "loading" | "scanning" | "ready" | "placed";

export type ArPlacementAction =
  | { readonly type: "data-loaded" }
  | { readonly type: "hit-found" }
  | { readonly type: "hit-lost" }
  | { readonly type: "place" }
  | { readonly type: "reposition" };

export function reduceArPlacementState(
  state: ArPlacementState,
  action: ArPlacementAction,
): ArPlacementState {
  switch (action.type) {
    case "data-loaded":
      return state === "loading" ? "scanning" : state;
    case "hit-found":
      return state === "scanning" ? "ready" : state;
    case "hit-lost":
      return state === "ready" ? "scanning" : state;
    case "place":
      return state === "ready" ? "placed" : state;
    case "reposition":
      return state === "placed" ? "scanning" : state;
  }
}

export function getArInstruction(state: ArPlacementState): string {
  switch (state) {
    case "loading":
      return "AR展示を準備しています。";
    case "scanning":
      return "カメラをゆっくり動かして壁を探してください。";
    case "ready":
      return "円が表示された位置をタップして展示を配置してください。";
    case "placed":
      return "投稿をタップすると詳細を表示します。";
  }
}
