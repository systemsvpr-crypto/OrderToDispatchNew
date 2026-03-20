// components/charts/VerticalBarChart.jsx
import React from 'react';

const VerticalBarChart = ({ data, labels, colors, maxValue }) => {
  return (
    <div className="w-full h-full">
      <div className="flex items-end justify-between h-full px-1 md:px-2 space-x-1 md:space-x-2">
        {data.map((value, index) => (
          <div key={index} className="flex flex-col items-center flex-1 h-full">
            {/* Value above bar */}
            <div className="mb-1 h-6 flex items-end">
              <span className="text-xs font-semibold text-gray-700">
                {value}%
              </span>
            </div>
            
            {/* Bar */}
            <div 
              className="w-full rounded-t transition-all duration-500 ease-out relative"
              style={{
                height: `${(value / maxValue) * 70}%`,
                backgroundColor: colors[index % colors.length],
                minHeight: '20px'
              }}
            />
            
            {/* Label */}
            <div className="mt-2 h-10 flex items-start">
              <span className="text-xs text-gray-600 text-center break-words leading-tight px-0.5 md:px-1">
                {labels[index]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VerticalBarChart;
