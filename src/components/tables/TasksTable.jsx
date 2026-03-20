import React from 'react';
import { Calendar, Flag, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} fmsName
 * @property {string} taskName
 * @property {string} personName
 * @property {string} todayTask
 * @property {string} pendingTillDate
 * @property {'completed'|'in-progress'|'pending'} status
 * @property {'high'|'medium'|'low'} priority
 */

/**
 * @typedef {Object} TasksTableProps
 * @property {Task[]} tasks - Array of task objects
 * @property {boolean} [isCompact=false] - Whether to display the table in compact mode
 * @property {'today'|'pending'} [type='today'] - Type of tasks to display
 */

/**
 * TasksTable component for displaying task data in a table format
 * @param {TasksTableProps} props
 * @returns {JSX.Element}
 */
const TasksTable = ({ tasks, isCompact = false, type = 'today' }) => {
  return (
    <div className={`bg-white rounded border border-gray-200 overflow-hidden ${isCompact ? 'max-h-96' : ''}`}>
      <div className="overflow-x-auto">
        <div className={`min-w-full ${isCompact ? 'max-h-96 overflow-y-auto' : ''}`}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  FMS Name
                </th>
                <th scope="col" className="hidden sm:table-cell px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Task Name
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Person
                </th>
                <th scope="col" className="hidden md:table-cell px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {type === 'today' ? 'Today Task' : 'All Pending'}
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="hidden lg:table-cell px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{task.fmsName}</div>
                    <div className="text-xs text-gray-500 sm:hidden">{task.taskName}</div>
                  </td>
                  <td className="hidden sm:table-cell px-3 py-2 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{task.taskName}</div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{task.personName}</div>
                  </td>
                  <td className="hidden md:table-cell px-3 py-2">
                    <div className="text-sm text-gray-900">
                      {type === 'today' ? task.todayTask : task.pendingTillDate}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      {task.status === 'completed' && <CheckCircle className="w-4 h-4 text-primary" />}
                      {task.status === 'in-progress' && <Clock className="w-4 h-4 text-primary" />}
                      {task.status === 'pending' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      <span className="ml-1.5 text-xs text-gray-700 capitalize">{task.status}</span>
                    </div>
                  </td>
                  <td className="hidden lg:table-cell px-3 py-2 whitespace-nowrap">
                    <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${task.priority === 'high' ? 'bg-red-100 text-primary' :
                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                      <Flag className="w-3 h-3 mr-1" />
                      {task.priority}
                    </div>
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

export default TasksTable;
