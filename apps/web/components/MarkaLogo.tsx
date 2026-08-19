import React from "react";
import Image from "next/image";
import { MARKA } from "@/lib/brand";

export default function MarkaLogo({ height }: { height: number }) {
  const width = Math.round((height * 510) / 135);

  return (
    <span className="flex items-center">
      <Image
        src={MARKA.wordmark.navy}
        alt={MARKA.name}
        width={width}
        height={height}
        style={{ height, width: "auto" }}
        className="dark:hidden"
      />
      <Image
        src={MARKA.wordmark.white}
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        style={{ height, width: "auto" }}
        className="hidden dark:block"
      />
    </span>
  );
}
