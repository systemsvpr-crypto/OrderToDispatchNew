import React from 'react';
import { TrendingUp } from 'lucide-react';

const StatsCard = ({ title, value, icon: Icon = TrendingUp, color = 'green', trend }) => {
  const colorClasses = {
    blue: {
      border: 'border-blue-200',
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-600',
      gradient: 'from-blue-50 to-blue-100'
    },
    green: {
      border: 'border-green-200',
      iconBg: 'bg-green-100',
      iconText: 'text-green-600',
      gradient: 'from-green-50 to-green-100'
    },
    orange: {
      border: 'border-orange-200',
      iconBg: 'bg-orange-100',
      iconText: 'text-orange-600',
      gradient: 'from-orange-50 to-orange-100'
    },
    purple: {
      border: 'border-purple-200',
      iconBg: 'bg-purple-100',
      iconText: 'text-purple-600',
      gradient: 'from-purple-50 to-purple-100'
    },
    amber: {
      border: 'border-amber-200',
      iconBg: 'bg-amber-100',
      iconText: 'text-amber-600',
      gradient: 'from-amber-50 to-amber-100'
    }
  };

  const currentColor = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`bg-gradient-to-br ${currentColor.gradient} rounded p-4 sm:p-6 border ${currentColor.border} shadow-sm hover:shadow-md transition-all duration-200 group`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0 flex-1">
          <div className={`p-2 sm:p-3 rounded ${currentColor.iconBg} mr-3 sm:mr-4 group-hover:scale-110 transition-transform duration-200`}>
            <Icon className={`w-4 h-4 sm:w-6 sm:h-6 ${currentColor.iconText}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{title}</p>
            <h4 className="text-lg sm:text-2xl font-bold text-gray-800 mt-1 truncate">{value}</h4>
          </div>
        </div>
      </div>

      {trend && (
        <div className="mt-3 sm:mt-4 flex items-center">
          <span className={`flex items-center text-xs sm:text-sm font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}%
          </span>
          <span className="text-xs sm:text-sm text-gray-500 ml-2 truncate">{trend.label}</span>
        </div>
      )}
    </div>
  );
};

// Add prop validation
StatsCard.defaultProps = {
  icon: TrendingUp,
  color: 'green',
  trend: null,
};

export default StatsCard;
