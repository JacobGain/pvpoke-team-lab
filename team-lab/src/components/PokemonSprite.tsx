import { CircleDotDashed } from "lucide-react";

import { pokemonSpriteManifest } from "@/generated/pokemonSprites";

export function PokemonSprite({
  speciesId,
  speciesName,
  size = "medium",
  eager = false,
}: {
  readonly speciesId: string;
  readonly speciesName: string;
  readonly size?: "small" | "medium" | "large" | "hero";
  readonly eager?: boolean;
}) {
  const normalizedId = speciesId.replace(/_shadow$/, "");
  const sprite = pokemonSpriteManifest[normalizedId];
  const isShadow = speciesId.endsWith("_shadow");
  const spritePath = sprite
    ? `${import.meta.env.BASE_URL}${sprite.path.replace(/^\//, "")}`
    : undefined;

  return (
    <span
      className={`pokemon-sprite pokemon-sprite--${size}${isShadow ? " pokemon-sprite--shadow" : ""}`}
    >
      {spritePath ? (
        <img
          alt={`${speciesName} artwork`}
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          src={spritePath}
        />
      ) : (
        <CircleDotDashed aria-label={`${speciesName} artwork unavailable`} />
      )}
      {isShadow ? <span className="pokemon-sprite__shadow-mark">S</span> : null}
    </span>
  );
}
