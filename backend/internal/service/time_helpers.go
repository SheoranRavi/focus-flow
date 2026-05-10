package service

import "time"

func dateInTimezone(timezone string) time.Time {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}

	now := time.Now().In(loc)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
}

func previousISODate(date string) (string, error) {
	parsed, err := time.Parse("2006-01-02", date)
	if err != nil {
		return "", err
	}
	return parsed.AddDate(0, 0, -1).Format("2006-01-02"), nil
}
