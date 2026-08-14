import React from "react";
import { MARKA } from "@/lib/brand";

export default function MarkaLogo({ height }: { height: number }) {
  return (
    <span className="flex items-center">
      <img
        src={MARKA.wordmark.navy}
        alt={MARKA.name}
        height={height}
        className="dark:hidden"
      />
      <img
        src={MARKA.wordmark.white}
        alt=""
        aria-hidden="true"
        height={height}
        className="hidden dark:block"
      />
    </span>
  );
}
