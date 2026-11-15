import { useEffect, useState } from "react";
import { CountdownCircleTimer } from "react-countdown-circle-timer";
import type { DayPrice } from "@/lib/premium-offer";
import { TIMER_COLORS, dayIntro, formatMoney, splitElapsed } from "@/lib/premium-offer";
import type { AppConfig } from "@/lib/settings";
import { usePremiumCheckout } from "@/components/PaymentProvider";
import { cn } from "@/lib/utils";

interface Props {
  prices: DayPrice[];
  today: number;
  signupAt: Date;
  settings: AppConfig;
}

function dayLabel(d: number, today: number) {
  if (d === today) return `Jour (${d}) (Aujourd'hui)`;
  if (d === today + 1) return `Jour (${d}) (demain)`;
  return `Jour (${d})`;
}

export function PremiumCountdown({ prices, today, signupAt, settings }: Props) {
  const { startCheckout, busy } = usePremiumCheckout();
  const days = [...prices].sort((a, b) => a.day - b.day);
  const total = days.length || 1;
  const seconds = Math.max(1, settings.secondsPerDay || 6);
  const [day, setDay] = useState(today);
  const [cycle, setCycle] = useState(0);
  const [size, setSize] = useState(144);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => setDay(today), [today]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const update = () => setSize(window.innerWidth < 380 ? 128 : 144);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const indexOf = (d: number) => days.findIndex((p) => p.day === d);
  const amountOf = (d: number) => days.find((p) => p.day === d)?.amount ?? 0;
  const intro = (d: number) => dayIntro(d, today, amountOf(d), settings);
  const nextDay = (d: number) => days[(indexOf(d) + 1) % total]?.day ?? d;
  const isToday = day === today;
  const amount = amountOf(day);
  const slideDay = isToday ? nextDay(today) : day;
  const elapsed = splitElapsed(now - signupAt.getTime());
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-border bg-brand-card/90 p-5 shadow-lg">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center rounded-full border border-brand-alert/80 bg-brand-alert/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-alert shadow-glow-red">
          Super promo.
        </span>
        <span className="text-xs font-medium text-muted-foreground">Le prix augmente chaque jour</span>
      </div>

      <div className="grid grid-cols-2 items-center gap-3">
        <div className="flex items-center justify-center">
          <CountdownCircleTimer
            key={cycle}
            isPlaying
            duration={seconds}
            colors={[...TIMER_COLORS]}
            colorsTime={[seconds, seconds * 0.6, seconds * 0.3, 0]}
            size={size}
            strokeWidth={9}
            trailColor="#252834"
            onComplete={() => {
              setDay((d) => nextDay(d));
              setCycle((c) => c + 1);
              return { shouldRepeat: false };
            }}
          >
            {() => (
              <div key={day} role="timer" aria-live="polite" className="flex animate-day-pop flex-col items-center text-center">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Jour</span>
                <span className="my-0.5 text-3xl font-black leading-none">{day}</span>
                {isToday && <span className="mt-0.5 text-xs font-semibold text-brand-gold">(Aujourd'hui)</span>}
                {day === today + 1 && <span className="mt-0.5 text-xs font-semibold text-muted-foreground">(demain)</span>}
              </div>
            )}
          </CountdownCircleTimer>
        </div>
        <div className="flex flex-col justify-center pl-1 text-left">
          <p className="text-xs font-medium leading-snug text-foreground/85">{intro(day)}</p>
          <div
            className={cn(
              "my-1.5 text-2xl font-black tracking-tight",
              isToday ? "text-brand-gold" : "text-muted-foreground line-through",
            )}
          >
            {formatMoney(amount, settings.currency)}
          </div>
          {isToday && (
            <button
              type="button"
              disabled={busy}
              onClick={() => startCheckout()}
              className="w-full rounded-xl bg-cta px-2 py-3 text-center text-xs font-bold leading-tight text-brand-ink shadow-glow transition-all active:brightness-95"
            >
              Obtenir l'offre
              <br />
              premium
            </button>
          )}
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Temps écoulé depuis votre inscription
        </span>
        <div className="w-full rounded-2xl border border-border/80 bg-brand-inset p-2.5 shadow-inner">
          <div className="flex items-center justify-around">
            {[
              [elapsed.days, "Jours"],
              [elapsed.hours, "Heures"],
              [elapsed.minutes, "Minutes"],
              [elapsed.seconds, "Secondes"],
            ].map(([v, l], i) => (
              <div key={String(l)} className="flex items-center gap-3">
                {i > 0 && <span className="pb-2 font-mono text-base font-bold text-brand-clock">:</span>}
                <div className="flex flex-col items-center">
                  <span className="font-mono text-lg font-extrabold tracking-wider text-brand-clock">{pad(Number(v))}</span>
                  <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{l}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 overflow-hidden">
        <li className="relative flex flex-col items-center justify-between rounded-2xl border-2 border-brand-gold/90 bg-brand-inset p-3 text-center shadow-glow">
          <div>
            <span className="text-xs font-semibold text-brand-gold">{dayLabel(today, today)}</span>
            <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{intro(today)}</p>
            <div className="my-1.5 text-xl font-black text-brand-gold">{formatMoney(amountOf(today), settings.currency)}</div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => startCheckout()}
            className="w-full rounded-xl bg-cta px-2 py-2.5 text-xs font-bold leading-tight text-brand-ink shadow-md transition active:scale-[0.98]"
          >
            J'en profite
          </button>
        </li>
        <li
          key={`slide-${slideDay}-${cycle}`}
          className={cn(
            "flex animate-slide-in flex-col items-center justify-start rounded-2xl border border-border bg-brand-inset/90 p-3 text-center opacity-75",
            slideDay === day && "ring-1 ring-brand-alert/60",
          )}
        >
          <span className="text-xs font-medium text-muted-foreground">{dayLabel(slideDay, today)}</span>
          <p className="mt-1 text-[10px] leading-tight text-muted-foreground/80">
            {intro(slideDay)}
          </p>
          <div className="my-1.5 text-xl font-bold text-muted-foreground line-through">
            {formatMoney(amountOf(slideDay), settings.currency)}
          </div>
        </li>
      </ul>
    </div>
  );
}
