import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isWithinInterval,
  addMonths,
  subMonths,
  getDay,
  isBefore,
  isAfter,
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { ChevronRight, ChevronLeft, X, Check } from 'lucide-react-native';

interface CalendarRangePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (startDate: Date, endDate: Date) => void;
  initialStartDate?: Date | null;
  initialEndDate?: Date | null;
  maxDate?: Date;
}

export default function CalendarRangePicker({
  visible,
  onClose,
  onConfirm,
  initialStartDate,
  initialEndDate,
  maxDate = new Date(),
}: CalendarRangePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [startDate, setStartDate] = useState<Date | null>(
    initialStartDate || null
  );
  const [endDate, setEndDate] = useState<Date | null>(initialEndDate || null);
  const [selectingStart, setSelectingStart] = useState(true);

  const weekDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const handleDatePress = (date: Date) => {
    if (selectingStart) {
      setStartDate(date);
      setEndDate(null);
      setSelectingStart(false);
    } else {
      if (startDate && isBefore(date, startDate)) {
        setStartDate(date);
        setEndDate(startDate);
      } else {
        setEndDate(date);
      }
    }
  };

  const handleConfirm = () => {
    if (startDate && endDate) {
      onConfirm(startDate, endDate);
    }
  };

  const handleReset = () => {
    setStartDate(null);
    setEndDate(null);
    setSelectingStart(true);
  };

  const renderMonth = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const firstDayOfWeek = getDay(monthStart);
    const emptyCells = Array(firstDayOfWeek).fill(null);

    const isDateInRange = (date: Date) => {
      if (!startDate || !endDate) return false;
      try {
        return isWithinInterval(date, { start: startDate, end: endDate });
      } catch {
        return false;
      }
    };

    const isStartDate = (date: Date) => {
      return startDate && isSameDay(date, startDate);
    };

    const isEndDate = (date: Date) => {
      return endDate && isSameDay(date, endDate);
    };

    const isDisabled = (date: Date) => {
      return isAfter(date, maxDate);
    };

    return (
      <View style={styles.monthContainer} key={monthDate.toISOString()}>
        <Text style={styles.monthTitle}>
          {format(monthDate, 'MMMM yyyy', { locale: ar })}
        </Text>

        <View style={styles.weekDaysRow}>
          {weekDays.map((day) => (
            <View key={day} style={styles.weekDayCell}>
              <Text style={styles.weekDayText}>{day}</Text>
            </View>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {emptyCells.map((_, index) => (
            <View key={`empty-${index}`} style={styles.dayCell} />
          ))}
          {days.map((day) => {
            const inRange = isDateInRange(day);
            const isStart = isStartDate(day);
            const isEnd = isEndDate(day);
            const disabled = isDisabled(day);

            return (
              <TouchableOpacity
                key={day.toISOString()}
                style={[
                  styles.dayCell,
                  inRange && styles.dayCellInRange,
                  (isStart || isEnd) && styles.dayCellSelected,
                  disabled && styles.dayCellDisabled,
                ]}
                onPress={() => !disabled && handleDatePress(day)}
                disabled={disabled}
              >
                <View
                  style={[
                    styles.dayContent,
                    (isStart || isEnd) && styles.dayContentSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      inRange && !isStart && !isEnd && styles.dayTextInRange,
                      (isStart || isEnd) && styles.dayTextSelected,
                      disabled && styles.dayTextDisabled,
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>اختر الفترة الزمنية</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.navigationRow}>
            <TouchableOpacity
              onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}
              style={styles.navButton}
            >
              <ChevronLeft size={24} color="#10B981" />
            </TouchableOpacity>

            <View style={styles.selectionInfo}>
              {startDate && (
                <Text style={styles.selectionText}>
                  من: {format(startDate, 'dd MMM yyyy', { locale: ar })}
                </Text>
              )}
              {endDate && (
                <Text style={styles.selectionText}>
                  إلى: {format(endDate, 'dd MMM yyyy', { locale: ar })}
                </Text>
              )}
              {!startDate && !endDate && (
                <Text style={styles.hintText}>اختر تاريخ البداية</Text>
              )}
              {startDate && !endDate && (
                <Text style={styles.hintText}>اختر تاريخ النهاية</Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}
              style={[
                styles.navButton,
                (isSameDay(startOfMonth(currentMonth), startOfMonth(maxDate)) ||
                  isAfter(startOfMonth(currentMonth), startOfMonth(maxDate))) &&
                  styles.navButtonDisabled,
              ]}
              disabled={
                isSameDay(startOfMonth(currentMonth), startOfMonth(maxDate)) ||
                isAfter(startOfMonth(currentMonth), startOfMonth(maxDate))
              }
            >
              <ChevronRight
                size={24}
                color={
                  isSameDay(startOfMonth(currentMonth), startOfMonth(maxDate)) ||
                  isAfter(startOfMonth(currentMonth), startOfMonth(maxDate))
                    ? '#D1D5DB'
                    : '#10B981'
                }
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {renderMonth(currentMonth)}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
            >
              <Text style={styles.resetButtonText}>إعادة تعيين</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!startDate || !endDate) && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!startDate || !endDate}
            >
              <Check size={20} color="#FFFFFF" />
              <Text style={styles.confirmButtonText}>تأكيد</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  navButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  selectionInfo: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  selectionText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
    marginVertical: 2,
  },
  hintText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  monthContainer: {
    padding: 16,
    minHeight: 350,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 45,
    padding: 2,
  },
  dayCellInRange: {
    backgroundColor: '#D1FAE5',
  },
  dayCellSelected: {
    backgroundColor: 'transparent',
  },
  dayCellDisabled: {
    opacity: 0.3,
  },
  dayContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
  },
  dayContentSelected: {
    backgroundColor: '#10B981',
  },
  dayText: {
    fontSize: 14,
    color: '#111827',
  },
  dayTextInRange: {
    color: '#059669',
    fontWeight: '600',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  dayTextDisabled: {
    color: '#D1D5DB',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
