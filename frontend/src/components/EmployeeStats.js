import React, { useState, useMemo } from 'react';
import { X as CloseIcon, Clock, Coffee, TrendingUp, Calendar, BarChart3, PieChart } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Cell, Pie } from 'recharts';

export function EmployeeStats({ employee, timeEntries, onClose, showSalary = false, formatSalary }) {
  const [period, setPeriod] = useState('week');

  const stats = useMemo(() => {
    const now = new Date();
    let filteredEntries = timeEntries.filter(entry => entry.employeeId === employee.id);

    // Filter by period
    if (period === 'week') {
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      filteredEntries = filteredEntries.filter(entry => new Date(entry.startTime) >= weekStart);
    } else if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      filteredEntries = filteredEntries.filter(entry => new Date(entry.startTime) >= monthStart);
    }

    // Calculate statistics
    const totalHours = filteredEntries.reduce((total, entry) => {
      if (entry.endTime) {
        const duration = (new Date(entry.endTime) - new Date(entry.startTime)) / (1000 * 60 * 60);
        return total + duration;
      }
      return total;
    }, 0);

    const totalBreakTime = filteredEntries.reduce((total, entry) => {
      if (entry.breaks && entry.breaks.length > 0) {
        const breakDuration = entry.breaks.reduce((breakTotal, breakItem) => {
          if (breakItem.endTime) {
            return breakTotal + (new Date(breakItem.endTime) - new Date(breakItem.startTime)) / (1000 * 60);
          }
          return breakTotal;
        }, 0);
        return total + breakDuration;
      }
      return total;
    }, 0);

    const workingDays = new Set(
      filteredEntries.map(entry => new Date(entry.startTime).toDateString())
    ).size;

    const averageHoursPerDay = workingDays > 0 ? totalHours / workingDays : 0;

    // Daily breakdown
    const dailyBreakdown = {};
    filteredEntries.forEach(entry => {
      const date = new Date(entry.startTime).toDateString();
      if (!dailyBreakdown[date]) {
        dailyBreakdown[date] = { hours: 0, breaks: 0 };
      }
      
      if (entry.endTime) {
        const duration = (new Date(entry.endTime) - new Date(entry.startTime)) / (1000 * 60 * 60);
        dailyBreakdown[date].hours += duration;
      }
      
      if (entry.breaks) {
        const breakDuration = entry.breaks.reduce((total, breakItem) => {
          if (breakItem.endTime) {
            return total + (new Date(breakItem.endTime) - new Date(breakItem.startTime)) / (1000 * 60);
          }
          return total;
        }, 0);
        dailyBreakdown[date].breaks += breakDuration;
      }
    });

    // Chart data
    const chartData = Object.entries(dailyBreakdown)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', month: 'short', day: 'numeric' }),
        hours: Math.round(data.hours * 10) / 10,
        breaks: Math.round(data.breaks)
      }));

    // Work pattern analysis
    const hourlyPattern = {};
    filteredEntries.forEach(entry => {
      const startHour = new Date(entry.startTime).getHours();
      const endHour = entry.endTime ? new Date(entry.endTime).getHours() : startHour;
      
      for (let hour = startHour; hour <= endHour; hour++) {
        hourlyPattern[hour] = (hourlyPattern[hour] || 0) + 1;
      }
    });

    const patternData = Object.entries(hourlyPattern).map(([hour, count]) => ({
      hour: `${hour}:00`,
      count
    }));

    // Overtime calculation
    const standardHours = period === 'week' ? 40 : period === 'month' ? 160 : totalHours;
    const overtimeHours = Math.max(0, totalHours - standardHours);

    return {
      totalHours: Math.round(totalHours * 10) / 10,
      totalBreakTime: Math.round(totalBreakTime),
      workingDays,
      averageHoursPerDay: Math.round(averageHoursPerDay * 10) / 10,
      overtimeHours: Math.round(overtimeHours * 10) / 10,
      chartData,
      patternData,
      completedEntries: filteredEntries.filter(entry => entry.endTime).length,
      totalEntries: filteredEntries.length
    };
  }, [employee, timeEntries, period]);

  const pieData = [
    { name: 'Heures travaillées', value: stats.totalHours, color: '#8B5CF6' },
    { name: 'Heures de pause', value: stats.totalBreakTime / 60, color: '#F59E0B' },
  ];

  return (
    <div className="modal-overlay">
      <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{employee.name}</h2>
              <p className="text-sm text-gray-500">{employee.position}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="all">Tout</option>
            </select>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="stats-card stats-card-total">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80">Total heures</p>
                  <p className="text-2xl font-bold text-white">{stats.totalHours}h</p>
                </div>
                <Clock className="w-8 h-8 text-white/60" />
              </div>
            </div>
            <div className="stats-card stats-card-completed">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80">Jours travaillés</p>
                  <p className="text-2xl font-bold text-white">{stats.workingDays}</p>
                </div>
                <Calendar className="w-8 h-8 text-white/60" />
              </div>
            </div>
            <div className="stats-card stats-card-pending">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80">Moyenne/jour</p>
                  <p className="text-2xl font-bold text-white">{stats.averageHoursPerDay}h</p>
                </div>
                <TrendingUp className="w-8 h-8 text-white/60" />
              </div>
            </div>
            <div className="stats-card stats-card-overdue">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80">Heures sup.</p>
                  <p className="text-2xl font-bold text-white">{stats.overtimeHours}h</p>
                </div>
                <Coffee className="w-8 h-8 text-white/60" />
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Daily Hours Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Heures quotidiennes</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [`${value}h`, name === 'hours' ? 'Heures' : 'Pauses (min)']}
                  />
                  <Line type="monotone" dataKey="hours" stroke="#8B5CF6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Work Pattern */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Modèle de travail</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.patternData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value}`, 'Jours actifs']} />
                  <Bar dataKey="count" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Time Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition du temps</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}h`, 'Durée']} />
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="flex justify-center space-x-4 mt-4">
                {pieData.map((entry, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                    <span className="text-sm text-gray-600">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Résumé</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Pointages terminés</span>
                  <span className="font-semibold text-gray-900">{stats.completedEntries}/{stats.totalEntries}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Temps de pause total</span>
                  <span className="font-semibold text-gray-900">{stats.totalBreakTime} min</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Heures standard</span>
                  <span className="font-semibold text-gray-900">
                    {period === 'week' ? '40h' : period === 'month' ? '160h' : `${stats.totalHours}h`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Efficacité</span>
                  <span className="font-semibold text-green-600">
                    {Math.round((stats.completedEntries / Math.max(stats.totalEntries, 1)) * 100)}%
                  </span>
                </div>
                {employee.hourlyRate > 0 && showSalary && (
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-gray-600">Salaire estimé</span>
                    <span className="font-semibold text-purple-600">
                      {formatSalary ? formatSalary(stats.totalHours, employee.hourlyRate) : `${Math.round(stats.totalHours * employee.hourlyRate)} FCFA`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}