import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar as faStarSolid } from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";

/**
 * The star flagging an instance as favorite of the user - a toggle button. The look is the one of the instance list
 * (favorite-toggle in EditorHome.css).
 */
export default function FavoriteButton({
  favorite,
  instanceName,
  onToggle,
  className,
}: {
  favorite: boolean;
  instanceName: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`favorite-toggle${favorite ? " favorite-toggle--active" : ""}${className ? ` ${className}` : ""}`}
      aria-pressed={favorite}
      aria-label={favorite ? `Remove ${instanceName} from favorites` : `Add ${instanceName} to favorites`}
      title={favorite ? "Remove from favorites" : "Add to favorites"}
      onClick={onToggle}
    >
      <FontAwesomeIcon icon={favorite ? faStarSolid : faStarRegular} />
    </button>
  );
}
