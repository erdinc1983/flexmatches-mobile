import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { SPACE, FONT } from "../lib/theme";

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const { width: SCREEN_W } = Dimensions.get("window");
const CELL_SIZE = Math.floor((SCREEN_W - 48 - 6 * 4) / 7);

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function todayStr(): string { return toDateStr(new Date()); }

type Props = {
  value: string;
  onChange: (d: string) => void;
  colors: any;
};

export function CalendarPicker({ value, onChange, colors }: Props) {
  const today = new Date();
  const initDate = value ? new Date(value + "T12:00:00") : today;
  const [vm, setVm] = useState({ year: initDate.getFullYear(), month: initDate.getMonth() });
  const { year, month } = vm;

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const todayS  = todayStr();
  const dayStr  = (d: number) =>
    `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const isSelected = (d: number) => value === dayStr(d);
  const isPast     = (d: number) => dayStr(d) < todayS;

  return (
    <View style={s.root}>
      <View style={s.nav}>
        <TouchableOpacity
          onPress={() => setVm(({ year: y, month: m }) => m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 })}
          hitSlop={10}
        >
          <Text style={[s.navArrow, { color: colors.textMuted }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[s.monthLabel, { color: colors.text }]}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity
          onPress={() => setVm(({ year: y, month: m }) => m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 })}
          hitSlop={10}
        >
          <Text style={[s.navArrow, { color: colors.textMuted }]}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={s.row}>
        {DAY_LABELS.map((l) => (
          <Text key={l} style={[s.dayHeader, { color: colors.textFaint ?? colors.textMuted }]}>{l}</Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={s.row}>
          {row.map((day, ci) => {
            if (day === null) return <View key={ci} style={s.cell} />;
            const past = isPast(day);
            const sel  = isSelected(day);
            return (
              <TouchableOpacity
                key={ci}
                style={[s.cell, sel && { backgroundColor: "#FF4500", borderRadius: 20 }]}
                onPress={() => !past && onChange(dayStr(day))}
                disabled={past}
                hitSlop={2}
              >
                <Text style={[
                  s.dayText,
                  { color: past ? (colors.textFaint ?? colors.textMuted) : sel ? "#fff" : colors.text },
                  sel && { fontWeight: "900" },
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root:      { paddingVertical: SPACE[8] },
  nav:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE[10] },
  navArrow:  { fontSize: 26, lineHeight: 30, fontWeight: "300" },
  monthLabel:{ fontSize: FONT.size.base, fontWeight: FONT.weight.extrabold },
  row:       { flexDirection: "row", marginBottom: 2 },
  dayHeader: { width: CELL_SIZE, textAlign: "center", fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, paddingBottom: 4 },
  cell:      { width: CELL_SIZE, height: CELL_SIZE, alignItems: "center", justifyContent: "center" },
  dayText:   { fontSize: FONT.size.sm },
});
