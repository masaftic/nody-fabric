
/**
 * Extract birthdate from Egyptian national ID 
 * Egyptian national ID format:
 * Digits 1-1: Century (2 = 1900s, 3 = 2000s)
 * Digits 2-3: Year of birth (last two digits)
 * Digits 4-5: Month of birth
 * Digits 6-7: Day of birth
 * 
 * @param nationalId The Egyptian National ID (14 digits)
 * @returns Date object representing the birthdate or null if invalid
 */
export function extractBirthdateFromNationalId(nationalId: string): Date | null {
    if (!nationalId || nationalId.length !== 14 || !/^\d+$/.test(nationalId)) {
        return null;
    }

    try {
        const century = nationalId.charAt(0) === '2' ? '19' : '20';
        const year = century + nationalId.substring(1, 3);
        const month = nationalId.substring(3, 5);
        const day = nationalId.substring(5, 7);

        const birthdate = new Date(`${year}-${month}-${day}`);
        
        // Check if the date is valid
        if (isNaN(birthdate.getTime())) {
            return null;
        }
        
        // Make sure the date is not in the future and is reasonable
        const today = new Date();
        if (birthdate > today || birthdate < new Date('1900-01-01')) {
            return null;
        }

        return birthdate;
    } catch (error) {
        return null;
    }
}

/**
 * Calculate age based on birthdate
 * @param birthdate The birthdate to calculate age from
 * @returns The age in years
 */
export function calculateAge(birthdate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthdate.getFullYear();
    const m = today.getMonth() - birthdate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) {
        age--;
    }
    return age;
}

/**
 * Get age group for analytics
 * @param age The age in years
 * @returns The age group label
 */
export function getAgeGroup(age: number): string {
    if (age < 18) return "0-17"; // Should not exist in voting system
    if (age <= 24) return "18-24";
    if (age <= 34) return "25-34";
    if (age <= 44) return "35-44";
    if (age <= 54) return "45-54";
    return "55+";
}

/**
 * Extract age from Egyptian National ID
 * @param nationalId The Egyptian National ID (14 digits)
 * @returns The age in years or null if invalid
 */
export function extractAgeFromNationalId(nationalId: string): number | null {
    const birthdate = extractBirthdateFromNationalId(nationalId);
    if (!birthdate) {
        return null;
    }
    return calculateAge(birthdate);
}

/**
 * Get age group directly from national ID
 * @param nationalId The Egyptian National ID (14 digits)
 * @returns The age group label or null if invalid
 */
export function getAgeGroupFromNationalId(nationalId: string): string | null {
    const age = extractAgeFromNationalId(nationalId);
    if (age === null) {
        return null;
    }
    return getAgeGroup(age);
}
