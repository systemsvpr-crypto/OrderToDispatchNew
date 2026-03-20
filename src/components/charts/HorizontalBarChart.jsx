import React from 'react';
import './HorizontalBarChart.css';

const HorizontalBarChart = ({ data, labels, colors, maxValue }) => {
  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {/* Fixed Header (optional – you can remove if not needed) */}
      {/* <div className="pb-2 border-b border-gray-200 flex-shrink-0">
        <p className="text-sm font-semibold text-gray-700">Performance Overview</p>
      </div> */}

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto min-h-0 horizontal-chart-scroll">
        <div className="py-2">
          <div className="space-y-3">
            {data.map((value, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 px-1"
              >
                {/* Label – Flexible width to show full names */}
                <div
                  className="flex-shrink-0 text-sm font-medium text-gray-700 mr-3"
                  style={{ minWidth: '150px', maxWidth: '40%' }}
                  title={labels[index]}
                >
                  {labels[index]}
                </div>

                {/* Bar Container */}
                <div className="flex-1 bg-gray-200 rounded h-5 md:h-6 overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-700 ease-out shadow-sm"
                    style={{
                      width: `${Math.min((value / maxValue) * 100, 100)}%`,
                      backgroundColor: colors[index % colors.length],
                    }}
                  />
                </div>

                {/* Value */}
                <div className="w-12 text-right flex-shrink-0">
                  <span className="text-sm font-bold text-gray-800">
                    {value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HorizontalBarChart;
