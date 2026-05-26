'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PerformanceMetric {
  name: string;
  value: number;
  max: number;
}

interface ChartComponentProps {
  data: PerformanceMetric[];
}

export default function ChartComponent({ data }: ChartComponentProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#3b82f6" name="当前值" />
        <Bar dataKey="max" fill="#e5e7eb" name="最大值" />
      </BarChart>
    </ResponsiveContainer>
  );
}
