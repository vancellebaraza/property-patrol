import { useEffect, useState } from "react";

type Theme = "light";

function getInitialTheme(): Theme {
  return "light";
}

export function useTheme() {
  const [theme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  };

  return { theme, toggleTheme };
}
