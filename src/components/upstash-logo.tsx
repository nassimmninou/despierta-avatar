import React, { HTMLProps } from "react";

export interface Props extends HTMLProps<SVGSVGElement> {
  size?: number;
}

export default function UpstashLogo({ height = 20, ...props }: Props) {
  return (
    <img src="/despierta.png"/>
  );
}
