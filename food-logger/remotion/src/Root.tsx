import React from "react";
import { Composition } from "remotion";
import { SaladLogo } from "./SaladLogo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SaladLogo"
      component={SaladLogo}
      durationInFrames={90}
      fps={30}
      width={360}
      height={360}
    />
  );
};
