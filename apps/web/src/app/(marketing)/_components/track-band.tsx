import { Camera, Droplet, Dumbbell, Keyboard, ScanBarcode } from "lucide-react";
import { RotatingWord } from "./rotating-word";

const METHODS = [
  { icon: Camera, label: "Photo" },
  { icon: Keyboard, label: "Typing" },
  { icon: ScanBarcode, label: "Barcode" },
  { icon: Dumbbell, label: "Workouts" },
  { icon: Droplet, label: "Water" },
];

/** Dark band: "Track [Nutrition / Workout / Progress] at one place" + every way to log. */
export function TrackBand() {
  return (
    <section className="bg-fitr8-night px-4 py-14 text-center text-white sm:py-[88px]">
      <h2 className="text-[38px] leading-[1.15] font-semibold tracking-[-0.025em] sm:text-[60px]">
        <span className="flex items-start justify-center gap-4">
          Track
          <RotatingWord words={["Nutrition", "Workout", "Progress"]} />
        </span>
        <span className="block">at one place</span>
      </h2>
      <ul className="mx-auto mt-7 flex max-w-[720px] flex-wrap justify-center gap-2.5">
        {METHODS.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3.5 py-2 text-[15px] font-semibold text-white/80"
          >
            <Icon className="size-[18px] text-fitr8-lilac" aria-hidden />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
