import React from 'react';

const HalfCircleChart = ({ data, labels, colors }) => {
  const total = data.reduce((sum, value) => sum + value, 0);
  let currentAngle = -180;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      {/* Chart Container */}
      <div className="relative w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48">
        <svg
          viewBox="0 0 100 50"
          className="w-full h-full"
        >
          {data.map((value, index) => {
            const percentage = (value / total) * 100;
            const angle = (percentage / 100) * 180;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            currentAngle = endAngle;

            // Calculate arc path
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;
            const x1 = 50 + 40 * Math.cos(startRad);
            const y1 = 50 + 40 * Math.sin(startRad);
            const x2 = 50 + 40 * Math.cos(endRad);
            const y2 = 50 + 40 * Math.sin(endRad);
            const largeArcFlag = angle > 180 ? 1 : 0;

            const pathData = [
              `M 50 50`,
              `L ${x1} ${y1}`,
              `A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              `Z`
            ].join(' ');

            return (
              <path
                key={index}
                d={pathData}
                fill={colors[index % colors.length]}
                stroke="white"
                strokeWidth="1"
              />
            );
          })}
        </svg>
        
        {/* Center Text */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-center">
          <div className="text-xs md:text-sm font-semibold text-gray-700">Top 5</div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 md:mt-4 w-full max-w-xs">
        <div className="grid grid-cols-1 gap-1 md:gap-2">
          {labels.map((label, index) => (
            <div key={index} className="flex items-center space-x-2 text-xs">
              <div
                className="w-3 h-3 rounded flex-shrink-0"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="text-gray-600 truncate flex-1">{label}</span>
              <span className="text-gray-800 font-semibold flex-shrink-0">
                {data[index]}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HalfCircleChart;
