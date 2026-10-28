using Microsoft.Extensions.Logging;
using TAKAHATA.Application.Common.Interface.Repositories;
using TAKAHATA.Application.Common.Interface.Services;

namespace TAKAHATA.Application.Services
{
    public class DailyJob
    {
        private readonly ILogger<DailyJob> _logger;
        private readonly IPartProcessRepository _partProcessRepository;
        private readonly IMachineRepository _machineRepository;
        private readonly IUnitOfWorkRepository _unitOfWorkRepository;
        private readonly IPLCService _plcService;

        public DailyJob(
            ILogger<DailyJob> logger,
            IPartProcessRepository partProcessRepository,
            IMachineRepository machineRepository,
            IUnitOfWorkRepository unitOfWorkRepository,
            IPLCService plcService)
        {
            _logger = logger;
            _partProcessRepository = partProcessRepository;
            _machineRepository = machineRepository;
            _unitOfWorkRepository = unitOfWorkRepository;
            _plcService = plcService;
        }

        public async Task ExecuteAsync()
        {
            _logger.LogInformation("DailyJob bắt đầu lúc {Time}", DateTimeOffset.Now);
            await _partProcessRepository.HandleExtend();
            _logger.LogInformation("DailyJob hoàn thành");
        }

        public async Task SendDailyTimeCutoverCommandAsync()
        {
            await SendDailyTimeCutoverCommandAsync(VietnamTime.Today.AddDays(-1));
        }

        public async Task SendDailyTimeCutoverCommandAsync(
            DateOnly reportDate)
        {
            var currentDate = reportDate.AddDays(1);
            var machines = await _machineRepository.GetAsync();
            var failures = new List<Exception>();

            foreach (var machine in machines)
            {
                if (machine.ProcessStatusBitAddress <= 0)
                {
                    _logger.LogWarning(
                        "Bỏ qua gửi lệnh chốt thời gian cho máy {MachineCode}: chưa cấu hình ProcessStatusBitAddress",
                        machine.Code);
                    continue;
                }

                var pendingReportDate = await _unitOfWorkRepository.PrepareDailyCutoverAsync(
                    machine.Id,
                    reportDate);
                if (pendingReportDate.HasValue)
                {
                    _logger.LogInformation(
                        "Không gửi lệnh chốt mới cho máy {MachineCode}: đang chờ phản hồi chốt ngày trước đó.",
                        machine.Code);
                    continue;
                }

                var result = await _plcService.WriteProcessStatus(machine, 8);
                if (!result.IsSuccess)
                {
                    var error = result.Error ?? new InvalidOperationException(
                        $"Không gửi được lệnh chốt thời gian cho máy {machine.Code}.");
                    await _unitOfWorkRepository.CancelDailyCutoverAsync(
                        machine.Id,
                        reportDate);
                    _logger.LogError(
                        error,
                        "Gửi lệnh chốt thời gian 8 thất bại cho máy {MachineCode}",
                        machine.Code);
                    failures.Add(error);
                    continue;
                }

                await _unitOfWorkRepository.MarkDailyCutoverCommandSentAsync(
                    machine.Id,
                    reportDate);
                _logger.LogInformation(
                    "Đã gửi lệnh chốt thời gian 8 cho máy {MachineCode}; ngày tổng hợp {ReportDate}, ngày tiếp nối {ContinuationDate}",
                    machine.Code,
                    reportDate,
                    currentDate);
            }

            if (failures.Count > 0)
            {
                throw new AggregateException(
                    "Không gửi được lệnh chốt thời gian cho một hoặc nhiều máy.",
                    failures);
            }
        }

    }

    public sealed class DailyCutoverPendingException(string message) : Exception(message)
    {
    }
}
