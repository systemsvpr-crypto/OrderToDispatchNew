import React from 'react';
import PropTypes from 'prop-types';

const EmployeesTable = ({ employees, isCompact = false }) => {
  return (
    <div className={`bg-white rounded border border-gray-200 overflow-hidden ${isCompact ? 'max-h-96' : ''}`}>
      <div className="overflow-x-auto">
        <div className={`min-w-full ${isCompact ? 'max-h-96 overflow-y-auto' : ''}`}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Start
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date End
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actual Work Done
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % Work Done
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % Work Done On Time
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Work Done
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Week Pending
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        <img
                          className="h-8 w-8 rounded object-cover"
                          src={employee.image}
                          alt={employee.name}
                        />
                      </div>
                      <div className="ml-2">
                        <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                        <div className="text-xs text-gray-500">{employee.department}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                    {employee.dateStart}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                    {employee.dateEnd}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                    {employee.target}%
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded h-2 mr-2">
                        <div
                          className="h-2 rounded bg-primary"
                          style={{ width: `${employee.actualWorkDone}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600">{employee.actualWorkDone}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded h-2 mr-2">
                        <div
                          className="h-2 rounded bg-primary"
                          style={{ width: `${employee.workDoneOnTime}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600">{employee.workDoneOnTime}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded h-2 mr-2">
                        <div
                          className="h-2 rounded bg-primary"
                          style={{ width: `${employee.totalWorkDone}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600">{employee.totalWorkDone}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${employee.weekPending > 3 ? 'bg-red-100 text-primary' :
                      employee.weekPending > 1 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                      {employee.weekPending}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

EmployeesTable.propTypes = {
  employees: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      image: PropTypes.string.isRequired,
      department: PropTypes.string.isRequired,
      dateStart: PropTypes.string.isRequired,
      dateEnd: PropTypes.string.isRequired,
      target: PropTypes.number.isRequired,
      actualWorkDone: PropTypes.number.isRequired,
      workDoneOnTime: PropTypes.number.isRequired,
      totalWorkDone: PropTypes.number.isRequired,
      weekPending: PropTypes.number.isRequired
    })
  ).isRequired,
  isCompact: PropTypes.bool
};

export default EmployeesTable;
