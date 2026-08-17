import { Monitor, Moon, Sun } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTheme, type ThemePreference } from "@/hooks/use-theme";

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <ToggleGroup
      type="single"
      value={preference}
      // Radix emits "" when the active item is pressed again; keep the current
      // preference rather than falling into an unset state.
      onValueChange={(value) => value && setPreference(value as ThemePreference)}
      variant="outline"
      size="sm"
      aria-label="Colour theme"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <ToggleGroupItem key={value} value={value} aria-label={label} title={label}>
          <Icon aria-hidden className="size-4" />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
