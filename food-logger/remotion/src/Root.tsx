import React from "react";
import { Composition } from "remotion";
import { SaladLogo } from "./SaladLogo";
import { AmbientSteam } from "./AmbientSteam";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SaladLogo"
        component={SaladLogo}
        durationInFrames={90}
        fps={30}
        width={360}
        height={360}
      />
      <Composition
        id="AmbientSteam"
        component={AmbientSteam}
        durationInFrames={120}
        fps={30}
        width={400}
        height={300}
      />
    </>
  );
};
