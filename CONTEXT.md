# Fitness Training

This context describes how the app represents a person's planned training, performed workouts, progress, and goals.

## Training plan

**Training block**:
A named group of exercises that forms one kind of planned workout, such as push, pull, legs, or cardio.
_Avoid_: Session, workout (when referring to the reusable plan)

**Weekly plan**:
The intended arrangement of training activities across a repeating seven-day week.
_Avoid_: Schedule (when referring to the plan as a whole)

**Planned workout**:
The activity intended for one place in the weekly plan, which may be a training block, cardio, or rest.
_Avoid_: Exercise, training day

**Rest day**:
A planned day whose intended activity is recovery and therefore requires no completion record.
_Avoid_: Missed day

**Cardio day**:
A planned day focused on cardiovascular activity, recorded with measures such as duration or distance rather than strength-training sets alone.
_Avoid_: Conditioning block (unless the plan explicitly distinguishes it)

**Training day**:
A dated occurrence of a planned workout, including its current completion state.
_Avoid_: Weekday, calendar day

**Plan occurrence**:
The dated instance created when a weekly plan assigns a planned workout to a particular date.
_Avoid_: Schedule row, weekday

**Exercise**:
A reusable movement or activity that can be prescribed in a training block and recorded during a workout.
_Avoid_: Movement (as the canonical data term)

## Performed training

**Workout session**:
One attempt to carry out a training day; it can be in progress, completed, partially completed, or skipped.
_Avoid_: Training day, workout log

**Set**:
One performed round of an exercise, with its own measured result when the user records detailed data.
_Avoid_: Rep (a rep is one repetition within a set)

**Training record**:
An observed result from a performed exercise, either a quick summary or a set-level measurement.
_Avoid_: Workout (when referring to one recorded result)

**Adherence**:
The degree to which performed training matches the planned workouts for their dates, including completed, partial, skipped, and rescheduled outcomes.
_Avoid_: Progress, completion count

**Quick completion**:
A deliberate completion of a planned workout without measured exercise results; it confirms attendance but does not create invented performance data.
_Avoid_: Fake log, automatic result

**Exercise substitution**:
An exercise performed in place of a planned exercise, while retaining the relationship to the original plan.
_Avoid_: Replacement (as the canonical product term)

**Exercise library**:
The collection of reusable exercises available to plans and training records, including built-in and user-created exercises.
_Avoid_: Exercise list, movement library

**Archived exercise**:
An exercise no longer available for new plans but retained so historical training records remain meaningful.
_Avoid_: Deleted exercise

## Progress

**Goal**:
A desired training outcome that the user tracks and may mark as achieved.
_Avoid_: Task, milestone (unless the distinction is later made explicit)

**Body metric**:
A dated personal measurement, such as body weight, that is tracked separately from exercise performance.
_Avoid_: Exercise weight

**Training feedback**:
Optional subjective information about a workout, such as perceived effort, fatigue, discomfort, or a note, recorded without making a medical judgment.
_Avoid_: Medical assessment
