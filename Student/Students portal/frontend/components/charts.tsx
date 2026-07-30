"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { departmentStats, statistics } from "@/lib/data";

export function PlacementTrendChart() {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <LineChart data={statistics}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="placed" stroke="#123D7A" strokeWidth={3} name="Placed %" />
          <Line type="monotone" dataKey="average" stroke="#45B8C8" strokeWidth={3} name="Average LPA" />
          <Line type="monotone" dataKey="highest" stroke="#F4B63F" strokeWidth={3} name="Highest LPA" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DepartmentBarChart() {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <BarChart data={departmentStats}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="department" tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="offers" fill="#123D7A" radius={[8, 8, 0, 0]} />
          <Bar dataKey="placed" fill="#F4B63F" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
