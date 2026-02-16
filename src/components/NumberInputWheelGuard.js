"use client";

import { useEffect } from "react";

export function NumberInputWheelGuard() {
  useEffect(() => {
    const handleWheel = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const numberInput = target.closest('input[type="number"]');
      if (!numberInput || document.activeElement !== numberInput) {
        return;
      }

      // Prevent accidental wheel increments while preserving normal typing.
      event.preventDefault();
      numberInput.blur();
    };

    window.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: false,
    });

    return () => {
      window.removeEventListener("wheel", handleWheel, {
        capture: true,
      });
    };
  }, []);

  return null;
}

export default NumberInputWheelGuard;
