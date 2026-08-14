import React from "react";
import { MARKA } from "@/lib/brand";

export default function MarkaLogo({ height }: { height: number }) {
  return (
    <span className="flex items-center">
      <img
        src={MARKA.wordmark.navy}
        alt={MARKA.name}
        height={height}
        style={{ height, width: "auto" }}
        className="dark:hidden"
      />
      <img
        src={MARKA.wordmark.white}
        alt=""
        aria-hidden="true"
        height={height}
        style={{ height, width: "auto" }}
        className="hidden dark:block"
      />
    </span>
  );
}
