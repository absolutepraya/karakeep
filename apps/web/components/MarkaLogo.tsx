import React from "react";
import Image from "next/image";
import { MARKA } from "@/lib/brand";

export default function MarkaLogo({ height }: { height: number }) {
  return (
    <span className="flex items-center">
      <Image
        src={MARKA.wordmark.navy}
        alt={MARKA.name}
        width={510}
        height={height}
        style={{ height, width: "auto" }}
        className="dark:hidden"
      />
      <Image
        src={MARKA.wordmark.white}
        alt=""
        aria-hidden="true"
        width={510}
        height={height}
        style={{ height, width: "auto" }}
        className="hidden dark:block"
      />
    </span>
  );
}
